# Reconcile demo recording checklist

This is a recording plan, not a published demo video. A real screen recording and a public video URL must be created by the maintainer before an OpenAI directory submission.

## Suggested recording (90–120 seconds)

1. **Opening (0:00–0:10):** Show the Reconcile dashboard and explain that it compares datasets deterministically.
2. **Load sample data (0:10–0:25):** Use only synthetic CSV files, such as sample-source-a.csv and sample-source-b.csv. Show detected columns and row counts.
3. **Configure matching (0:25–0:40):** Select the record key (for example, id) and the field to compare (for example, amount). Briefly show the tolerance option.
4. **Run comparison (0:40–1:00):** Run the comparison and show matched rows, missing records, duplicates, and value mismatches.
5. **Inspect and export (1:00–1:15):** Open the differences view, search/filter a result, and download the CSV report.
6. **MCP workflow (1:15–1:45):** In a real MCP client, connect to the production endpoint https://recon-mcp-dgn15.vercel.app/api/mcp, discover the tools, and run one comparison using synthetic data. Show the returned summary and structured result.
7. **Privacy close (1:45–2:00):** Show the published Privacy Policy and Terms pages. State accurately that the app does not intentionally persist datasets, while hosting-provider logs are outside the app's control.

## Before publishing the video

- Use synthetic, non-sensitive sample data only.
- Record the real product UI and a real MCP client; do not fabricate tool output or imply unsupported integrations.
- Verify the production endpoint and policy pages immediately before recording.
- Keep the recording publicly accessible without sign-in (for example, an unlisted YouTube video).
- Paste the final public video URL into the OpenAI plugin submission metadata as review.demo_recording_url.
- Do not submit this checklist URL as the demo recording URL.
