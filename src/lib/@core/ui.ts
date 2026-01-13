/**
 * Simple terminal spinner for progress indication
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private frame = 0;
  private text: string;
  private isInteractive: boolean;

  constructor(text: string) {
    this.text = text;
    this.isInteractive = process.stdout.isTTY && process.env.CI !== 'true';
  }

  start(): void {
    if (!this.isInteractive) {
      console.log(`${this.text}...`);
      return;
    }

    process.stdout.write('\x1B[?25l'); // Hide cursor
    this.render();
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % this.frames.length;
      this.render();
    }, 80);
  }

  stop(success = true): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.isInteractive) {
      const symbol = success ? '✔' : '✖';
      const color = success ? '\x1b[32m' : '\x1b[31m'; // Green/Red
      const reset = '\x1b[0m';

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${color}${symbol}${reset} ${this.text}\n`);
      process.stdout.write('\x1B[?25h'); // Show cursor
    } else {
      // Only log done if non-interactive (start already logged)
      if (success) console.log(`${this.text} Done.`);
    }
  }

  update(text: string): void {
    this.text = text;
    if (this.isInteractive && this.interval) {
      this.render();
    }
  }

  private render(): void {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${this.frames[this.frame]} ${this.text}`);
  }
}

/**
 * Helper to show progress for async tasks
 */
export async function withSpinner<T>(
  text: string,
  task: (spinner: Spinner) => Promise<T>,
): Promise<T> {
  const spinner = new Spinner(text);
  spinner.start();
  try {
    const result = await task(spinner);
    spinner.stop(true);
    return result;
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}
