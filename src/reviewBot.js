const { Octokit } = require("@octokit/rest");
const { Configuration, OpenAIApi } = require("openai");

const githubToken = process.env.MY_GITHUB_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

const octokit = new Octokit({ auth: githubToken });

const configuration = new Configuration({
  apiKey: openaiApiKey,
});
const openai = new OpenAIApi(configuration);

async function main() {
  const { context } = require("@actions/github");
  const { owner, repo, number: pull_number } = context.issue;

  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const files = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });

  let changes = "";
  for (const file of files.data) {
    const content = await octokit.repos.getContent({
      owner,
      repo,
      path: file.filename,
    });

    const fileContent = Buffer.from(content.data.content, 'base64').toString();
    changes += `File: ${file.filename}\n${fileContent}\n\n`;
  }

  const prompt = `Please review the following changes:\n${changes}`;

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: prompt,
    max_tokens: 1500,
  });

  const reviewComment = response.data.choices[0].text;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: reviewComment,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
