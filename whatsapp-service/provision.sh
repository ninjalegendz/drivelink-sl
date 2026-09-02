#!/usr/bin/env bash
# Provision the DriveLink WhatsApp service on a fresh Ubuntu box.
#
# The service is Baileys behind Express. It binds to 127.0.0.1 on purpose, so
# Caddy terminates TLS in front of it and nothing reaches the Node process
# except through the proxy.
#
# Run as:
#   sudo WA_TOKEN='<the shared token>' WA_DOMAIN='wa.drivelink.lk' bash provision.sh
#
# The token is passed in rather than written here, so this file carries no
# secret and can live in the repo.
set -euo pipefail

WA_DOMAIN="${WA_DOMAIN:-wa.drivelink.lk}"
APP_DIR=/opt/drivelink-wa
SERVICE_USER=drivelink

if [ -z "${WA_TOKEN:-}" ]; then
  echo "WA_TOKEN is required. Re-run with:  sudo WA_TOKEN='...' bash provision.sh" >&2
  exit 1
fi

echo "==> 1/7  System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

echo "==> 2/7  Node.js 22"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "    node $(node -v)"

echo "==> 3/7  Caddy (automatic TLS)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key     | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt     | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> 4/7  Service files"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$APP_DIR"
base64 -d > "$APP_DIR/server.mjs" <<'B64_SERVER'
Ly8gRHJpdmVMaW5rIFdoYXRzQXBwIHNlcnZpY2UgKEJhaWxleXMpLg0KLy8NCi8vIEEgc21hbGwgYWx3YXlzLW9uIE5vZGUgcHJv
Y2VzcyB0aGF0IGhvbGRzIE9ORSBXaGF0c0FwcCBXZWIgc2Vzc2lvbiBhbmQgbGV0cw0KLy8gdGhlIERyaXZlTGluayBDbG91ZGZs
YXJlIFdvcmtlciBzZW5kIG1lc3NhZ2VzIG92ZXIgSFRUUC4gSXQgY2Fubm90IGxpdmUgaW4NCi8vIHRoZSBXb3JrZXIgKEJhaWxl
eXMgbmVlZHMgYSBwZXJzaXN0ZW50IHNvY2tldCArIGRpc2spLCBzbyBpdCBydW5zIGhlcmUgb24gdGhlDQovLyBWUFMgdW5kZXIg
cG0yLCBiZWhpbmQgbmdpbngsIGFuZCBpcyByZWFjaGVkIGF0IGh0dHBzOi8vd2EuZHJpdmVsaW5rLmxrLg0KLy8NCi8vIEVuZHBv
aW50cyAoYWxsIGJ1dCAvaGVhbHRoIHJlcXVpcmUgYEF1dGhvcml6YXRpb246IEJlYXJlciA8V0FfU0VSVklDRV9UT0tFTj5gKToN
Ci8vICAgR0VUICAvaGVhbHRoICAtPiB7IG9rLCBjb25uZWN0ZWQgfSAgICAgICAgICAgIChubyBhdXRoIOKAlCBmb3Igbmdpbngv
dXB0aW1lKQ0KLy8gICBHRVQgIC9zdGF0dXMgIC0+IHsgY29ubmVjdGVkLCB1c2VyIH0NCi8vICAgR0VUICAvcXIgICAgICAtPiB7
IGNvbm5lY3RlZCwgcXIgfSAgICAgICAgICAgICAocXIgPSBkYXRhLVVSTCB0byBzY2FuKQ0KLy8gICBQT1NUIC9zZW5kICAgIC0+
IHsgdG8sIG1lc3NhZ2UgfSAtPiB7IG9rLCBpZCB9DQovLyAgIFBPU1QgL2xvZ291dCAgLT4gd2lwZXMgdGhlIHNlc3Npb24sIHJl
LXBhaXJzDQoNCmltcG9ydCB7IHJtIH0gZnJvbSAibm9kZTpmcy9wcm9taXNlcyI7DQppbXBvcnQgZXhwcmVzcyBmcm9tICJleHBy
ZXNzIjsNCmltcG9ydCBxcmNvZGUgZnJvbSAicXJjb2RlIjsNCmltcG9ydCBwaW5vIGZyb20gInBpbm8iOw0KaW1wb3J0IG1ha2VX
QVNvY2tldCwgew0KICB1c2VNdWx0aUZpbGVBdXRoU3RhdGUsDQogIERpc2Nvbm5lY3RSZWFzb24sDQogIGZldGNoTGF0ZXN0QmFp
bGV5c1ZlcnNpb24sDQogIEJyb3dzZXJzLA0KfSBmcm9tICJAd2hpc2tleXNvY2tldHMvYmFpbGV5cyI7DQoNCmNvbnN0IFBPUlQg
ICAgID0gTnVtYmVyKHByb2Nlc3MuZW52LlBPUlQgfHwgMzQwMCk7DQpjb25zdCBUT0tFTiAgICA9IHByb2Nlc3MuZW52LldBX1NF
UlZJQ0VfVE9LRU4gfHwgIiI7DQpjb25zdCBBVVRIX0RJUiA9IHByb2Nlc3MuZW52LldBX0FVVEhfRElSIHx8ICIuL2F1dGgiOw0K
DQpjb25zdCBsb2dnZXIgPSBwaW5vKHsgbGV2ZWw6ICJ3YXJuIiB9KTsNCg0KbGV0IHNvY2sgICAgICA9IG51bGw7DQpsZXQgbGF0
ZXN0UXIgID0gbnVsbDsgIC8vIGRhdGEtVVJMIHN0cmluZyB3aGlsZSBwYWlyaW5nLCBudWxsIG9uY2UgY29ubmVjdGVkDQpsZXQg
Y29ubmVjdGVkID0gZmFsc2U7DQpsZXQgbWVVc2VyICAgID0gbnVsbDsNCg0KYXN5bmMgZnVuY3Rpb24gc3RhcnRTb2NrKCkgew0K
ICBjb25zdCB7IHN0YXRlLCBzYXZlQ3JlZHMgfSA9IGF3YWl0IHVzZU11bHRpRmlsZUF1dGhTdGF0ZShBVVRIX0RJUik7DQogIGNv
bnN0IHsgdmVyc2lvbiB9ID0gYXdhaXQgZmV0Y2hMYXRlc3RCYWlsZXlzVmVyc2lvbigpOw0KDQogIHNvY2sgPSBtYWtlV0FTb2Nr
ZXQoew0KICAgIHZlcnNpb24sDQogICAgYXV0aDogc3RhdGUsDQogICAgbG9nZ2VyLA0KICAgIHByaW50UVJJblRlcm1pbmFsOiBm
YWxzZSwNCiAgICBicm93c2VyOiBCcm93c2Vycy51YnVudHUoIkRyaXZlTGluayIpLA0KICAgIHN5bmNGdWxsSGlzdG9yeTogZmFs
c2UsDQogICAgbWFya09ubGluZU9uQ29ubmVjdDogZmFsc2UsDQogIH0pOw0KDQogIHNvY2suZXYub24oImNyZWRzLnVwZGF0ZSIs
IHNhdmVDcmVkcyk7DQoNCiAgc29jay5ldi5vbigiY29ubmVjdGlvbi51cGRhdGUiLCBhc3luYyAodSkgPT4gew0KICAgIGNvbnN0
IHsgY29ubmVjdGlvbiwgbGFzdERpc2Nvbm5lY3QsIHFyIH0gPSB1Ow0KDQogICAgaWYgKHFyKSB7DQogICAgICBsYXRlc3RRciAg
PSBhd2FpdCBxcmNvZGUudG9EYXRhVVJMKHFyKTsNCiAgICAgIGNvbm5lY3RlZCA9IGZhbHNlOw0KICAgIH0NCiAgICBpZiAoY29u
bmVjdGlvbiA9PT0gIm9wZW4iKSB7DQogICAgICBjb25uZWN0ZWQgPSB0cnVlOw0KICAgICAgbGF0ZXN0UXIgID0gbnVsbDsNCiAg
ICAgIG1lVXNlciAgICA9IHNvY2sudXNlciA/PyBudWxsOw0KICAgICAgbG9nZ2VyLndhcm4oIlt3YV0gY29ubmVjdGVkIGFzICVz
IiwgbWVVc2VyPy5pZCk7DQogICAgfQ0KICAgIGlmIChjb25uZWN0aW9uID09PSAiY2xvc2UiKSB7DQogICAgICBjb25uZWN0ZWQg
PSBmYWxzZTsNCiAgICAgIGNvbnN0IGNvZGUgPSBsYXN0RGlzY29ubmVjdD8uZXJyb3I/Lm91dHB1dD8uc3RhdHVzQ29kZTsNCiAg
ICAgIGlmIChjb2RlID09PSBEaXNjb25uZWN0UmVhc29uLmxvZ2dlZE91dCkgew0KICAgICAgICBsYXRlc3RRciA9IG51bGw7DQog
ICAgICAgIG1lVXNlciAgID0gbnVsbDsNCiAgICAgICAgbG9nZ2VyLndhcm4oIlt3YV0gbG9nZ2VkIG91dCDigJQgY2xlYXJpbmcg
c2Vzc2lvbiIpOw0KICAgICAgICBhd2FpdCBybShBVVRIX0RJUiwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pLmNh
dGNoKCgpID0+IHt9KTsNCiAgICAgICAgc2V0VGltZW91dChzdGFydFNvY2ssIDE1MDApOyAvLyByZS1pbml0IC0+IGVtaXRzIGEg
ZnJlc2ggUVINCiAgICAgIH0gZWxzZSB7DQogICAgICAgIGxvZ2dlci53YXJuKCJbd2FdIGNvbm5lY3Rpb24gY2xvc2VkICglcykg
4oCUIHJlY29ubmVjdGluZyIsIGNvZGUpOw0KICAgICAgICBzZXRUaW1lb3V0KHN0YXJ0U29jaywgMzAwMCk7DQogICAgICB9DQog
ICAgfQ0KICB9KTsNCn0NCg0Kc3RhcnRTb2NrKCkuY2F0Y2goKGUpID0+IGxvZ2dlci5lcnJvcihlLCAiW3dhXSBzdGFydFNvY2sg
ZmFpbGVkIikpOw0KDQpjb25zdCBhcHAgPSBleHByZXNzKCk7DQphcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiAiMjU2a2Ii
IH0pKTsNCg0KLy8gSGVhbHRoIGlzIHB1YmxpYyBzbyBuZ2lueC91cHRpbWUgY2hlY2tzIGRvbid0IG5lZWQgdGhlIHRva2VuLg0K
YXBwLmdldCgiL2hlYWx0aCIsIChfcmVxLCByZXMpID0+IHJlcy5qc29uKHsgb2s6IHRydWUsIGNvbm5lY3RlZCB9KSk7DQoNCi8v
IEV2ZXJ5dGhpbmcgYmVsb3cgcmVxdWlyZXMgdGhlIHNoYXJlZCB0b2tlbi4NCmFwcC51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7
DQogIGlmICghVE9LRU4pIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAiV0FfU0VSVklDRV9UT0tFTiBub3Qg
Y29uZmlndXJlZCIgfSk7DQogIGlmICgocmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbiB8fCAiIikgIT09IGBCZWFyZXIgJHtUT0tF
Tn1gKSB7DQogICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAxKS5qc29uKHsgZXJyb3I6ICJ1bmF1dGhvcml6ZWQiIH0pOw0KICB9DQog
IG5leHQoKTsNCn0pOw0KDQphcHAuZ2V0KCIvc3RhdHVzIiwgKF9yZXEsIHJlcykgPT4NCiAgcmVzLmpzb24oeyBjb25uZWN0ZWQs
IHVzZXI6IG1lVXNlciA/IHsgaWQ6IG1lVXNlci5pZCwgbmFtZTogbWVVc2VyLm5hbWUgPz8gbnVsbCB9IDogbnVsbCB9KSwNCik7
DQoNCmFwcC5nZXQoIi9xciIsIChfcmVxLCByZXMpID0+IHJlcy5qc29uKHsgY29ubmVjdGVkLCBxcjogY29ubmVjdGVkID8gbnVs
bCA6IGxhdGVzdFFyIH0pKTsNCg0KYXBwLnBvc3QoIi9zZW5kIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7DQogIGNvbnN0IHsgdG8s
IG1lc3NhZ2UgfSA9IHJlcS5ib2R5IHx8IHt9Ow0KICBpZiAoIXRvIHx8ICFtZXNzYWdlKSAgICAgIHJldHVybiByZXMuc3RhdHVz
KDQwMCkuanNvbih7IGVycm9yOiAidG8gYW5kIG1lc3NhZ2UgcmVxdWlyZWQiIH0pOw0KICBpZiAoIWNvbm5lY3RlZCB8fCAhc29j
aykgIHJldHVybiByZXMuc3RhdHVzKDUwMykuanNvbih7IGVycm9yOiAid2hhdHNhcHAgbm90IGNvbm5lY3RlZCIgfSk7DQoNCiAg
Y29uc3QgamlkID0gYCR7U3RyaW5nKHRvKS5yZXBsYWNlKC9cRC9nLCAiIil9QHMud2hhdHNhcHAubmV0YDsNCiAgdHJ5IHsNCiAg
ICBjb25zdCByID0gYXdhaXQgc29jay5zZW5kTWVzc2FnZShqaWQsIHsgdGV4dDogU3RyaW5nKG1lc3NhZ2UpIH0pOw0KICAgIHJl
cy5qc29uKHsgb2s6IHRydWUsIGlkOiByPy5rZXk/LmlkID8/IG51bGwgfSk7DQogIH0gY2F0Y2ggKGUpIHsNCiAgICBsb2dnZXIu
ZXJyb3IoZSwgIlt3YV0gc2VuZCBmYWlsZWQiKTsNCiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlPy5tZXNzYWdl
IHx8ICJzZW5kIGZhaWxlZCIgfSk7DQogIH0NCn0pOw0KDQphcHAucG9zdCgiL2xvZ291dCIsIGFzeW5jIChfcmVxLCByZXMpID0+
IHsNCiAgdHJ5IHsgYXdhaXQgc29jaz8ubG9nb3V0KCk7IH0gY2F0Y2ggeyAvKiBtYXkgYWxyZWFkeSBiZSBnb25lICovIH0NCiAg
Y29ubmVjdGVkID0gZmFsc2U7IGxhdGVzdFFyID0gbnVsbDsgbWVVc2VyID0gbnVsbDsNCiAgYXdhaXQgcm0oQVVUSF9ESVIsIHsg
cmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KS5jYXRjaCgoKSA9PiB7fSk7DQogIHNldFRpbWVvdXQoc3RhcnRTb2NrLCAx
NTAwKTsNCiAgcmVzLmpzb24oeyBvazogdHJ1ZSB9KTsNCn0pOw0KDQovLyBCaW5kIHRvIGxvY2FsaG9zdCBvbmx5IOKAlCBwdWJs
aWMgYWNjZXNzIGlzIHZpYSBuZ2lueCAoVExTKSBhdCB3YS5kcml2ZWxpbmsubGsuDQphcHAubGlzdGVuKFBPUlQsICIxMjcuMC4w
LjEiLCAoKSA9PiBsb2dnZXIud2FybigiW3dhXSBsaXN0ZW5pbmcgb24gMTI3LjAuMC4xOiVkIiwgUE9SVCkpOw0K
B64_SERVER
base64 -d > "$APP_DIR/package.json" <<'B64_PKG'
ewogICJuYW1lIjogImRyaXZlbGluay13aGF0c2FwcC1zZXJ2aWNlIiwKICAidmVyc2lvbiI6ICIxLjAuMCIsCiAgInByaXZhdGUi
OiB0cnVlLAogICJ0eXBlIjogIm1vZHVsZSIsCiAgImRlc2NyaXB0aW9uIjogIkFsd2F5cy1vbiBCYWlsZXlzIFdoYXRzQXBwIHNl
bmRlciBmb3IgRHJpdmVMaW5rIChydW5zIG9uIHRoZSBWUFMsIGNhbGxlZCBieSB0aGUgQ2xvdWRmbGFyZSBXb3JrZXIgb3ZlciBI
VFRQKS4iLAogICJzY3JpcHRzIjogewogICAgInN0YXJ0IjogIm5vZGUgc2VydmVyLm1qcyIKICB9LAogICJkZXBlbmRlbmNpZXMi
OiB7CiAgICAiQHdoaXNrZXlzb2NrZXRzL2JhaWxleXMiOiAiXjYuNy4xNiIsCiAgICAiZXhwcmVzcyI6ICJeNC4yMS4yIiwKICAg
ICJwaW5vIjogIl45LjUuMCIsCiAgICAicXJjb2RlIjogIl4xLjUuNCIKICB9Cn0K
B64_PKG
mkdir -p "$APP_DIR/auth"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "==> 5/7  Dependencies"
cd "$APP_DIR"
sudo -u "$SERVICE_USER" npm install --omit=dev --no-audit --no-fund --silent

echo "==> 6/7  systemd unit"
# The token lives in a root-only env file, not in the unit, so it stays out of
# `systemctl cat` and out of any process listing.
umask 077
cat > /etc/drivelink-wa.env <<ENVEOF
WA_SERVICE_TOKEN=$WA_TOKEN
WA_AUTH_DIR=$APP_DIR/auth
PORT=3400
ENVEOF
chmod 600 /etc/drivelink-wa.env
umask 022

cat > /etc/systemd/system/drivelink-wa.service <<'UNITEOF'
[Unit]
Description=DriveLink WhatsApp service (Baileys)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=drivelink
WorkingDirectory=/opt/drivelink-wa
EnvironmentFile=/etc/drivelink-wa.env
ExecStart=/usr/bin/node /opt/drivelink-wa/server.mjs
Restart=always
RestartSec=5
# WhatsApp drops the socket regularly; restarting quietly is normal operation.
StartLimitIntervalSec=0
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable --now drivelink-wa

cat > /etc/caddy/Caddyfile <<CADDYEOF
$WA_DOMAIN {
    reverse_proxy 127.0.0.1:3400
}
CADDYEOF
systemctl restart caddy

echo "==> 7/7  Host firewall"
# Oracle's Ubuntu images ship an iptables ruleset that REJECTs everything past
# SSH. Opening the ports in the VCN alone is the classic half-fix: the cloud
# lets the packet in and the box drops it.
#
# The rules MUST go above that catch-all REJECT. iptables stops at the first
# match, so an ACCEPT added below it is dead config that reads as correct in
# `iptables -L` and silently blocks everything. Hardcoding a line number is
# what caused exactly that, because the REJECT is not always at the same
# position, so find it instead.
for port in 80 443; do
  while iptables -D INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null; do :; done
done
REJECT_LINE="$(iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')"
if [ -n "$REJECT_LINE" ]; then
  iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport 80 -j ACCEPT
  iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport 443 -j ACCEPT
else
  iptables -A INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT
  iptables -A INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT
fi
apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
netfilter-persistent save >/dev/null 2>&1 || true

echo
echo "-------------------------------------------------------"
systemctl is-active --quiet drivelink-wa && echo "  service : running" || echo "  service : FAILED (journalctl -u drivelink-wa)"
systemctl is-active --quiet caddy        && echo "  caddy   : running" || echo "  caddy   : FAILED (journalctl -u caddy)"
echo "  local   : $(curl -s --max-time 5 http://127.0.0.1:3400/health || echo unreachable)"
echo
echo "  Next: open 80 and 443 in the VCN security list, point"
echo "  $WA_DOMAIN at this box (DNS only, grey cloud), then visit"
echo "  https://$WA_DOMAIN/health"
echo "-------------------------------------------------------"
