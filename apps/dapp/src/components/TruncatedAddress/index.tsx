interface Props {
  address: string;
}

const TruncatedAddress = ({ address }: Props) => {
  if (!address) {
    return null;
  }
  const start = address.slice(0, 6);
  const end = address.slice(-4);
  return (
    <span>
      {start}...{end}
    </span>
  );
};

export default TruncatedAddress;
