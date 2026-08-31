import { useId } from 'react';

import { Button } from '@astryxdesign/core/Button';

interface Props {
  ready: boolean;
  help: string;
}

export function CalculateButton({ ready, help }: Props) {
  const helpId = useId();

  return (
    <div className={`calculate-button-wrap ${ready ? 'is-ready' : 'is-pending'}`}>
      <Button
        label="본전 계산하기"
        variant="primary"
        size="lg"
        width="100%"
        type="submit"
        aria-describedby={ready ? undefined : helpId}
      />
      {!ready && (
        <p id={helpId} className="calculate-help">
          {help}
        </p>
      )}
    </div>
  );
}
