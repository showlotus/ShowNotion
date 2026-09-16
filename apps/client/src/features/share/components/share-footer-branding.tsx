import styles from "./share-footer-branding.module.css";

export default function ShareFooterBranding() {
  return (
    <footer className={styles.footer}>
      <a
        className={styles.branding}
        href="https://docmost.com?ref=public-share"
        target="_blank"
        rel="noreferrer"
      >
        Powered by ShowNotion
      </a>
    </footer>
  );
}
