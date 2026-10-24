import { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, LockKeyhole, LoaderCircle } from 'lucide-react';
import { getDesktop, saveDesktopPoster, unwrapDesktop } from '../services/desktop';
import { useI18n } from '../i18n/react';

export function DesktopGitHubAccess() {
  const desktop = getDesktop();
  const { locale, t } = useI18n();
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    desktop
      ?.credentialStatus(locale)
      .then((reply) => {
        if (alive) setConfigured(unwrapDesktop(reply));
      })
      .catch((error) => {
        if (alive) setMessage(error.message);
      });
    return () => {
      alive = false;
    };
  }, [desktop, locale]);
  if (!desktop) return null;
  async function save(value: string) {
    setBusy(true);
    setMessage('');
    try {
      setConfigured(unwrapDesktop(await desktop!.saveCredential(value, locale)));
      setToken('');
      setMessage(t(value ? '令牌已加密保存。' : '已移除保存的令牌。'));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="desktop-access">
      <summary>
        <LockKeyhole size={15} />
        {t('访问私有仓库（可选）')}
        {configured && <Check size={14} />}
      </summary>
      <p className="field-hint">
        {t(
          '公开仓库只需用户名。私有仓库可填写 GitHub 只读访问令牌，令牌会由系统加密保存在这台电脑。',
        )}
      </p>
      <label className="field">
        {t('GitHub 访问令牌')}
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={configured ? t('已保存；输入新令牌以替换') : 'github_pat_…'}
        />
      </label>
      <div className="desktop-access-actions">
        <button
          className="quiet-button"
          disabled={busy || !token.trim()}
          onClick={() => void save(token)}
        >
          {t('保存令牌')}
        </button>
        {configured && (
          <button className="quiet-button" disabled={busy} onClick={() => void save('')}>
            {t('移除令牌')}
          </button>
        )}
      </div>
      {message && (
        <p className="field-hint" role="status">
          {message}
        </p>
      )}
    </details>
  );
}

export function PosterDownload({ url, filename }: { url: string; filename: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!getDesktop())
    return (
      <a className="button" href={url} download={filename}>
        <ArrowDownToLine size={16} />
        {t('下载长图')}
      </a>
    );
  return (
    <div className="poster-save">
      {message && (
        <span className="field-hint" role="status">
          {message}
        </span>
      )}
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            if (await saveDesktopPoster(url, filename)) setMessage(t('图片已保存。'));
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}
        {t('保存到电脑')}
      </button>
    </div>
  );
}
