import { text } from "spectrum-ts";

export type Notifier = {
  send(userId: string, message: string): Promise<void>;
};

export function createConsoleNotifier(): Notifier {
  return {
    async send(userId: string, message: string): Promise<void> {
      const content = await text(message).build();
      const output = content.type === "text" ? content.text : message;
      console.log(`[Spectrum mock -> ${userId}] ${output}`);
    }
  };
}
