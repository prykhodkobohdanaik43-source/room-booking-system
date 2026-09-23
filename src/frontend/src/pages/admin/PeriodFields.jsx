import { Field } from '../../components/Field.jsx';

export function PeriodFields({ from, to, onChange }) {
  return (
    <div className="form__row period">
      <Field label="З">
        <input type="date" value={from} onChange={(event) => onChange({ from: event.target.value, to })} />
      </Field>
      <Field label="По">
        <input type="date" value={to} onChange={(event) => onChange({ from, to: event.target.value })} />
      </Field>
    </div>
  );
}
