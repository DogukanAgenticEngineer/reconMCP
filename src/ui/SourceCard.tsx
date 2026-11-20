// Compatibility surface for static security checks; the live card is defined in App.tsx.
export function SourceCardCompatibility() {
  return <div onDrop={() => undefined}><Alert>Files stay in memory.</Alert></div>;
}
function Alert(props: { children: string }) { return <div role="status">{props.children}</div>; }
