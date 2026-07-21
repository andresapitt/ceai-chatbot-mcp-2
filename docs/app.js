(() => {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messages = document.getElementById("messages");
  const button = form.querySelector("button");

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    addMessage(question, "user");
    input.value = "";
    button.disabled = true;
    const pending = addMessage("Thinking…", "bot pending");

    try {
      const res = await fetch(`${window.CHAT_API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      const data = await res.json();
      pending.remove();

      if (!res.ok) {
        addMessage(data.error || "Something went wrong. Please try again.", "error");
      } else {
        addMessage(data.reply, "bot");
      }
    } catch (err) {
      pending.remove();
      addMessage("Couldn't reach the assistant. Please try again shortly.", "error");
    } finally {
      button.disabled = false;
      input.focus();
    }
  });
})();
