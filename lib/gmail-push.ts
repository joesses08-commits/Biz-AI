export async function registerGmailPush(accessToken: string) {
  try {
    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        labelIds: ["INBOX"],
        topicName: "projects/biz-ai-489803/topics/gmail-push",
      }),
    });
  } catch (err) {
    console.error("Gmail push registration error:", err);
  }
}
