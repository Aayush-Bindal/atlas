// Simple console logger for MVP
export const logger = {
  info: (obj: any, msg?: string) => {
    console.log(
      JSON.stringify({
        ...obj,
        msg,
        level: "info",
        timestamp: new Date().toISOString(),
      }),
    );
  },
  error: (obj: any, msg?: string) => {
    console.error(
      JSON.stringify({
        ...obj,
        msg,
        level: "error",
        timestamp: new Date().toISOString(),
      }),
    );
  },
  warn: (obj: any, msg?: string) => {
    console.warn(
      JSON.stringify({
        ...obj,
        msg,
        level: "warn",
        timestamp: new Date().toISOString(),
      }),
    );
  },
};
