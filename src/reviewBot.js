const { Octokit } = require("@octokit/rest");
const { Configuration, OpenAIApi } = require("openai");
const core = require("@actions/core");
const github = require("@actions/github");

const githubToken = process.env.GITHUB_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

const octokit = new Octokit({ auth: githubToken });

const configuration = new Configuration({
  apiKey: openaiApiKey,
});
const openai = new OpenAIApi(configuration);

async function main() {
  try {
    const context = github.context;
    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;

    console.log(`Owner: ${owner}`);
    console.log(`Repo: ${repo}`);
    console.log(`Pull Request Number: ${pull_number}`);

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number,
    });

    console.log(`PR Data: ${JSON.stringify(pr)}`);

    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    console.log(`Files: ${JSON.stringify(files.data)}`);

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
    console.log(`Prompt: ${prompt}`);

    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 1500,
    });

    const reviewComment = response.data.choices[0].text;
    console.log(`Review Comment: ${reviewComment}`);

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: reviewComment,
    });

  } catch (error) {
    core.setFailed(error.message);
    console.error(error);
  }
}

main();
