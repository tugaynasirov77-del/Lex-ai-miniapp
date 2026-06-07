# Cloudflare Named Tunnel — операционная документация

## Текущая конфигурация

| Параметр | Значение |
|---|---|
| Hostname | `https://upload.lex-zavod.ru` |
| Tunnel name | `lex-upload` |
| Tunnel UUID | `30a9226f-e275-4fa9-9c8b-4999346530f3` |
| VPS | `5.42.97.203` (Timeweb) |
| Local target | `http://localhost:8080` (lex-upload service / upload_proxy.py) |
| Provider | Cloudflare Free plan, зона `lex-zavod.ru` |
| Vercel env | `UPLOAD_PROXY_URL=https://upload.lex-zavod.ru` |

## Файлы на VPS

| Файл | Назначение |
|---|---|
| `/root/.cloudflared/cert.pem` | Origin cert (получен при `cloudflared tunnel login`). **Секрет** |
| `/root/.cloudflared/30a9226f-...-530f3.json` | Tunnel credentials. **Секрет** |
| `/etc/cloudflared/config.yml` | Ingress rules + tunnel ID |
| `/etc/systemd/system/lex-tunnel.service` | systemd unit |
| `/var/log/cloudflared.log` | (legacy — для quick-tunnel; для named-tunnel логи в journal) |

## config.yml

```yaml
tunnel: 30a9226f-e275-4fa9-9c8b-4999346530f3
credentials-file: /root/.cloudflared/30a9226f-e275-4fa9-9c8b-4999346530f3.json
ingress:
  - hostname: upload.lex-zavod.ru
    service: http://localhost:8080
  - service: http_status:404
```

## systemd unit

```ini
[Unit]
Description=Cloudflare Named Tunnel — lex-upload (upload.lex-zavod.ru)
After=lex-upload.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Команды эксплуатации

```bash
# Статус
ssh root@5.42.97.203 'systemctl is-active lex-tunnel'

# Логи
ssh root@5.42.97.203 'journalctl -u lex-tunnel -n 50 --no-pager'

# Рестарт
ssh root@5.42.97.203 'systemctl restart lex-tunnel'

# Список tunnels
ssh root@5.42.97.203 'cloudflared tunnel list'

# Список DNS-маршрутов tunnel'а
ssh root@5.42.97.203 'cloudflared tunnel route ip show; cloudflared tunnel info lex-upload'

# Проверить публичный URL
curl -sI https://upload.lex-zavod.ru/
```

## Рестарт-резильентность

- systemd-unit с `Restart=on-failure RestartSec=10` — авто-рестарт при крэше
- `After=network-online.target Wants=network-online.target` — стартует после сети
- `Enable on boot`: `systemctl enable lex-tunnel`
- Tunnel UUID + credentials.json сохраняются на диске, **URL не меняется** при рестартах VPS

## Восстановление после поломки

### Tunnel перестал отвечать (HTTP timeout)
```bash
ssh root@5.42.97.203 'systemctl restart lex-tunnel; journalctl -u lex-tunnel -n 20'
```

### Credentials повреждены / удалены
```bash
ssh root@5.42.97.203 'cloudflared tunnel login'           # повторно авторизоваться
# при authorize выбрать зону lex-zavod.ru → cert.pem скачается
ssh root@5.42.97.203 'cloudflared tunnel create lex-upload-v2'   # если старый ID потерян
# обновить /etc/cloudflared/config.yml с новым UUID + json-файлом
ssh root@5.42.97.203 'cloudflared tunnel route dns lex-upload-v2 upload.lex-zavod.ru'
ssh root@5.42.97.203 'systemctl restart lex-tunnel'
```

### Нужно удалить tunnel
```bash
ssh root@5.42.97.203 'cloudflared tunnel delete lex-upload'
```

## Health-check

Endpoint upload_proxy: `https://upload.lex-zavod.ru/` → возвращает 404 (нет роутера для `/`).
Tunnel жив = HTTP-код приходит вообще (любой, кроме timeout/521/522/523).

## Что НЕ через этот tunnel
- Telegram bot — работает в polling-режиме на VPS (multi_bot.py), webhook не используется
- Mini App — на Vercel напрямую, без VPS
- API — на Vercel

Tunnel нужен **только** для приёма mp4-загрузок от Mini App в upload_proxy (iOS Telegram WebView блокирует прямой PUT в Supabase Storage).
