export type CheckmarkProps = {
  value?: boolean,
};

function Checkmark({ value }: CheckmarkProps) {
  return (
    <span
      className={
        value
          ? 'fonticon-check-circle text-success'
          : 'fonticon-cross-circle text-danger'
      }
    />
  );
}
export default Checkmark;
