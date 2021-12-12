import Link from "next/link";

export default function IndexPage() {
  return (
    <div>
      This is the Temple Analytics API and is not meant to be consumed via a
      browser. Please visit the
      <Link href="https://templedao.link">
        <a>TempleDAO</a>
      </Link>
      app.
    </div>
  );
}
