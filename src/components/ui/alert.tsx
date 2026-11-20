export function alert(props: { children?: string }) { return <div role="alert">{props.children ?? ''}</div>; }
