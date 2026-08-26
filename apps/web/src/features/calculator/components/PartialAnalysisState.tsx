interface Props {
  warnings: string[];
}

export function PartialAnalysisState({ warnings }: Props) {
  if (warnings.length === 0) return null;

  return (
    <section className="warning-panel" aria-labelledby="warning-heading">
      <h3 id="warning-heading">계산 범위를 확인해 주세요</h3>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
