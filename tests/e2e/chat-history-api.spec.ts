import { expect, test } from "@playwright/test"

const BASE = "/api/chat/conversations"

test.describe("chat history api", () => {
  test("creates a conversation, lists, renames, pins, deletes", async ({ request, baseURL }) => {
    test.skip(!baseURL, "baseURL is required")
    // 1. List initially — empty for a fresh anonymous owner. The set-cookie pins
    //    the owner so subsequent requests see the same store.
    const list1 = await request.get(BASE)
    expect(list1.ok()).toBeTruthy()

    // 2. Append a user message; conversation is created and a title is derived.
    const append = await request.post(BASE, {
      data: {
        message: { role: "user", content: "What screening is due for a 50yo woman?" },
      },
    })
    expect(append.ok()).toBeTruthy()
    const created = await append.json()
    expect(created.conversationId).toBeTruthy()
    expect(created.conversation.title).toContain("What screening is due")

    // 3. Append an agent reply.
    const reply = await request.post(BASE, {
      data: {
        conversationId: created.conversationId,
        message: { role: "agent", content: "Direct answer: …", agentId: "screening" },
      },
    })
    expect(reply.ok()).toBeTruthy()

    // 4. Rename
    const renamed = await request.patch(`${BASE}/${created.conversationId}`, {
      data: { title: "Screening — 50yo W" },
    })
    expect(renamed.ok()).toBeTruthy()
    expect((await renamed.json()).conversation.title).toBe("Screening — 50yo W")

    // 5. Pin
    const pinned = await request.patch(`${BASE}/${created.conversationId}`, {
      data: { pinned: true },
    })
    expect(pinned.ok()).toBeTruthy()
    expect((await pinned.json()).conversation.pinned).toBe(true)

    // 6. List shows the conversation first (pinned ahead of others).
    const list2 = await request.get(BASE)
    expect(list2.ok()).toBeTruthy()
    const list2Body = await list2.json()
    expect(list2Body.conversations[0].id).toBe(created.conversationId)
    expect(list2Body.conversations[0].pinned).toBe(true)

    // 7. Detail
    const detail = await request.get(`${BASE}/${created.conversationId}`)
    expect(detail.ok()).toBeTruthy()
    const detailBody = await detail.json()
    expect(detailBody.conversation.messages.length).toBeGreaterThanOrEqual(2)

    // 8. Delete
    const removed = await request.delete(`${BASE}/${created.conversationId}`)
    expect(removed.ok()).toBeTruthy()
    expect((await removed.json()).ok).toBe(true)

    const list3 = await request.get(BASE)
    expect(list3.ok()).toBeTruthy()
    const list3Body = await list3.json()
    expect(list3Body.conversations.find((c: { id: string }) => c.id === created.conversationId)).toBeUndefined()
  })
})
