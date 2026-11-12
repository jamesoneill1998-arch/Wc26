// Planning terms explained in place. The same wording is published at
// public/glossary.html; test/glossary.test.js keeps the two in step.

export const TERMS = {
  "abandonment": { term: "Abandonment", text: "The share of callers who hang up before they are answered. Erlang A forecasts it from how long callers are prepared to wait." },
  "aht": { term: "AHT (average handle time)", text: "The average time one contact takes, from answer to the end of any after-call work. Talk time, hold time and wrap-up are all included." },
  "asa": { term: "ASA (average speed of answer)", text: "The average wait before a contact is answered, measured across answered contacts." },
  "attrition": { term: "Attrition", text: "The rate at which people leave. Erlang Desk takes a monthly rate for each site and applies it week by week to tenured staff and to each new class." },
  "bias": { term: "Bias", text: "Whether the forecast ran high or low on recent weeks. Positive means it forecast more than arrived; negative means less." },
  "buffer": { term: "Buffer", text: "A share of operational FTE held back when testing whether a change can be absorbed, so the plan keeps a margin for error." },
  "change-board-pack": { term: "Change-board pack", text: "A printable paper for one business area: every change at a glance, the combined position if all open proposals are approved, and a section for each change." },
  "concurrency": { term: "Concurrency", text: "The number of chats one agent handles at the same time. Two or three is common. Higher concurrency lowers the staff needed and lengthens each chat." },
  "erlang": { term: "Erlang (unit)", text: "A measure of workload: one erlang is one hour of work arriving per hour. A queue offering 100 calls an hour at six minutes each carries 10 erlangs." },
  "erlang-a": { term: "Erlang A", text: "A queueing formula that allows for callers who hang up. It gives the staff needed for a service level and the abandonment rate to expect. Erlang Desk uses it for voice and chat." },
  "erlang-c": { term: "Erlang C", text: "The classic queueing formula. It assumes every caller waits until answered, so it asks for slightly more staff than Erlang A. Erlang Desk uses it for branches and offers it in the calculator." },
  "forecast-accuracy": { term: "Forecast accuracy (WAPE)", text: "Weighted absolute percentage error: the total size of the forecast misses divided by the total volume. Erlang Desk tests each method on recent weeks and uses the one with the lowest error." },
  "fte": { term: "FTE (full-time equivalent)", text: "Staff counted in full-time units. Two people on half the contracted hours are one FTE. Contracted hours are set for each site." },
  "headroom": { term: "Headroom", text: "Operational FTE left over after the work already committed, and after the buffer. A change is absorbable when it fits inside the headroom." },
  "interval": { term: "Interval", text: "The slice of the day used for staffing, usually 15 or 30 minutes. Requirements are worked out for every interval and then rolled up." },
  "mtp": { term: "MTP (medium-term plan)", text: "The agreed budget forecast for the year ahead. A change already counted in the MTP adds no extra requirement." },
  "nesting": { term: "Nesting", text: "The supervised period after training, when new starters take live contacts at reduced productivity." },
  "occupancy": { term: "Occupancy", text: "The share of logged-in time an agent spends handling contacts. Sustained occupancy above about 85 to 90 per cent tends to raise sickness and attrition." },
  "operational-fte": { term: "Operational FTE", text: "The productive FTE an area has available in a month, used as the supply side of an impact assessment." },
  "overtime-allowance": { term: "Overtime allowance", text: "The extra capacity an area can cover with overtime, as a share of operational FTE. A change that fits only with overtime is flagged as such." },
  "patience": { term: "Patience", text: "How long callers are prepared to wait before hanging up, on average. It is the input that separates Erlang A from Erlang C." },
  "ramp-up": { term: "Ramp-up", text: "The weeks between a class starting and its people being fully productive: training time plus nesting time." },
  "seasonality": { term: "Seasonality", text: "Repeating patterns in demand: by day of the week, by month, and around bank holidays. The forecast learns each of them from your history." },
  "service-level": { term: "Service level", text: "The share of contacts answered within a target time, such as 80 per cent in 20 seconds." },
  "shrinkage": { term: "Shrinkage", text: "Paid time that is unavailable for handling contacts: annual leave, sickness, breaks, training, meetings and system downtime. Erlang Desk itemises it for each site." },
  "turnaround-sla": { term: "Turnaround SLA", text: "For back-office work, the number of days allowed to complete an item. Work is smoothed across the turnaround window." },
  "utilisation": { term: "Utilisation", text: "For back-office work, the share of paid, available time spent on productive work. It plays the role that occupancy plays for calls." },
  "workload": { term: "Workload", text: "The hours of work to be done: contacts multiplied by average handle time." },
}

// A field or figure label is matched to its term, so explanations appear wherever the word does.
const MATCH = [
  [/shrinkage/i, 'shrinkage'], [/occupancy/i, 'occupancy'], [/attrition/i, 'attrition'], [/headroom/i, 'headroom'],
  [/service level/i, 'service-level'], [/\bASA\b/, 'asa'], [/abandon/i, 'abandonment'], [/accuracy|WAPE/i, 'forecast-accuracy'],
  [/^bias$/i, 'bias'], [/nesting/i, 'nesting'], [/^Erlang A$/, 'erlang-a'], [/^Erlang C$/, 'erlang-c'], [/patience/i, 'patience'],
  [/concurrency/i, 'concurrency'], [/buffer/i, 'buffer'], [/\bMTP\b/, 'mtp'], [/utilisation/i, 'utilisation'], [/lead time/i, 'ramp-up'],
  [/\bAHT\b/, 'aht'], [/operational FTE/i, 'operational-fte'], [/turnaround/i, 'turnaround-sla'], [/overtime/i, 'overtime-allowance'],
]

/** The glossary key for a label, or null. */
export function termFor(label) {
  if (typeof label !== 'string') return null
  const hit = MATCH.find(([re]) => re.test(label))
  return hit && TERMS[hit[1]] ? hit[1] : null
}
