export function CheckingState() {
  return (
    <div className="state state-loading" role="status">
      <h1>Checking the register</h1>
      <p>
        Looking up that credential id. This prototype reads a fixed sample, not a live register.
      </p>
    </div>
  );
}
