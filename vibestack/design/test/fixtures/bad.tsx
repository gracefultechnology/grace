export const Bad = () => (
  <div className="bg-red-500">
    <p className="text-[#fff]">a</p>
    <p style={{ color: "#fff" }}>b</p>
    {/* eslint-disable-next-line design-system/no-literal-colors */}
    <p style={{ color: "#000" }}>c</p>
    <p className="[box-shadow:0_0_0_4px_var(--primary)]">d</p>
    <p className="drop-shadow-[0_8px_18px_var(--primary)]">e</p>
  </div>
)
