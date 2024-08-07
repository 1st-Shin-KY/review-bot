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

    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    console.log(`Files: ${JSON.stringify(files.data)}`);

    let changes = "";
    for (const file of files.data) {
      changes += `ファイル名: ${file.filename}\n内容: ${file.patch}\n\n`;
    }

    const prompt = `回答はファイル名ごとにフォマットに合わせて作成してくれフォマットは以下になる：\nファイル名:{ファイル名} 内容:{内容}\n以下のコードをレビューしてくれ:\n${changes}`;
    // console.log(`Prompt: ${prompt}`);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const reviewComments = response.choices[0].message.content.split('ファイル名:').filter(comment => comment.trim() !== "").map(comment => {
      const [filename, ...content] = comment.split('内容:');
      return {
        filename: filename.trim(),
        content: content.join('内容:').trim()
      };
    });

    console.log(`Review Comments: ${JSON.stringify(reviewComments)}`);

    // const reviewComment = response.choices[0].message.content;
    // console.log(`Review Comment: ${reviewComment}`);

    const { data: commits } = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number,
    });
    const lastCommitId = commits[commits.length - 1].sha;

    for (const file of files.data) {
      const reviewCommentObj = reviewComments.find(comment => comment.filename === file.filename);
      if (!reviewCommentObj) continue;

      const reviewComment = reviewCommentObj.content;
      const lines = file.patch.split("\n");
      let lineNumber = 0;
      for (const line of lines) {
        if (line.startsWith("@@")) {
          const match = line.match(/@@ \-\d+,\d+ \+(\d+),\d+ @@/);
          if (match) {
            lineNumber = parseInt(match[1], 10) - 1;
          }
        } else {
          lineNumber++;
        }
      }

      await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number,
        body: reviewComment,
        commit_id: lastCommitId,
        path: file.filename,
        line: lineNumber,
        side: "RIGHT",
      });
    }
  } catch (error) {
    core.setFailed(error.message);
    console.error(error);
  }
}

main();
