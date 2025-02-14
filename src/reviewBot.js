const { Octokit } = require("@octokit/rest");
const { OpenAI } = require("openai");
const core = require("@actions/core");
const github = require("@actions/github");

const githubToken = process.env.GITHUB_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

const octokit = new Octokit({ auth: githubToken });

const openai = new OpenAI({ apiKey: openaiApiKey });

async function main() {
  try {
    const context = github.context;
    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;

    // console.log(`Owner: ${owner}`);
    // console.log(`Repo: ${repo}`);
    // console.log(`Pull Request Number: ${pull_number}`);

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number,
    });

    // console.log(`PR Data: ${JSON.stringify(pr)}`);

    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    // console.log(`Files: ${JSON.stringify(files.data)}`);

    let changes = "";
    for (const file of files.data) {
      changes += `File: ${file.filename}\n${file.patch}\n\n`;
    }

    const prompt = `以下のコードをレビューしてくれ:\n${changes}`;
    console.log(`Prompt: ${prompt}`);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const reviewComment = response.choices[0].message.content;
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
