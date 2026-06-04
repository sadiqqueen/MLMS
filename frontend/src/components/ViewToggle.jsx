export default function ViewToggle({ value, onChange, listValue = 'list' }) {
  return (
    <div className="view-toggle" aria-label="View mode">
      <button
        type="button"
        className={`view-btn${value === 'list' || value === 'table' ? ' active' : ''}`}
        onClick={() => onChange(listValue)}
        title="List view"
        aria-label="List view"
      >
        List
      </button>
      <button
        type="button"
        className={`view-btn${value === 'card' ? ' active' : ''}`}
        onClick={() => onChange('card')}
        title="Card view"
        aria-label="Card view"
      >
        Cards
      </button>
    </div>
  );
}
