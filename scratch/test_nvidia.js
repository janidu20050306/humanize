
const { OpenRouter } = require("@openrouter/sdk");
const OPENROUTER_API_KEY = "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";

async function test() {
  try {
    const openrouter = new OpenRouter({ apiKey: OPENROUTER_API_KEY });
    const response = await openrouter.chat.send({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: 'test' }],
    });
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}

test();
