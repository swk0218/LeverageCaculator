interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function PersistenceControl({ checked, onChange }: Props) {
  return (
    <section className="persistence-control" aria-label="입력 저장 설정">
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>
          <strong>30일간 저장</strong>
          <small className="sr-only">
            이 기기에만 저장됩니다. 공용 기기에서는 사용하지 마세요.
          </small>
        </span>
      </label>
    </section>
  );
}
