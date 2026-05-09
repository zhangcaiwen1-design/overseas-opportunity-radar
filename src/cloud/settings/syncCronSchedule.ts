export function toUtcCronExpression(dailyRunTime: string, timezone: string) {
  const matched = /^(\d{2}):(\d{2})$/.exec(dailyRunTime);
  if (!matched) {
    return '0 1 * * *';
  }

  const [, hourText, minuteText] = matched;
  const localHour = Number(hourText);
  const minute = Number(minuteText);

  const offsetHoursByTimezone: Record<string, number> = {
    'Asia/Shanghai': 8,
    UTC: 0,
  };

  const offsetHours = offsetHoursByTimezone[timezone] ?? 8;
  const utcHour = (localHour - offsetHours + 24) % 24;

  return `${minute} ${utcHour} * * *`;
}

export async function syncCronSchedule(input: { dailyRunTime: string; timezone: string }) {
  return toUtcCronExpression(input.dailyRunTime, input.timezone);
}
