// Benchmark inputs: small hand-written diagrams plus three real-world D2 files from D2's own test data (bench/cases/*.d2).
export const SMALL = {
  hello: 'browser -> server: request\nserver -> github: api call\ngithub: {\n  label: GitHub API\n}\n',
  microservices: 'direction: right\nclient -> gateway\ngateway -> auth\ngateway -> orders\ngateway -> search\norders -> db: write\norders -> queue: events\nqueue -> worker\nworker -> db\nsearch -> index\nauth -> db: sessions\n',
  containers: 'cloud: AWS {\n  lb: Load balancer\n  app: {\n    api; worker; cache\n    api -> worker: queue\n    api -> cache\n  }\n  db: {shape: cylinder}\n  lb -> app.api\n  app.worker -> db\n}\nuser -> cloud.lb: HTTPS\nuser -> cdn: static\ncdn -> cloud.lb\n',
  dense: 'a -> b; a -> c; a -> d; b -> e; b -> f; c -> f; c -> g; d -> g; d -> h; e -> i; f -> i; f -> j; g -> j; g -> k; h -> k; i -> l; j -> l; k -> l; l -> a\n',
};
export const REAL = ['queue_workers', 'jupyter_aws_eks', 'ross_overview'];
export const LAYOUTS = ['dagre', 'elk', 'tala'];
export async function loadCases() {
  const cases = Object.entries(SMALL).map(([name, text]) => ({ name, text, kind: 'small' }));
  for (const n of REAL) cases.push({ name: n, text: await (await fetch(new URL(`./cases/${n}.d2`, import.meta.url))).text(), kind: 'real-world' });
  return cases;
}
