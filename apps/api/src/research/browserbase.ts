
import Browserbase from "@browserbasehq/sdk";

export function getBrowserbase(): Browserbase {
  return new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
}
