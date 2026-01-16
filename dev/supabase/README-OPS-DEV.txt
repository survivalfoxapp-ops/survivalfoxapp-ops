
SSH Stability (ops)
- Server keepalive: /etc/ssh/sshd_config.d/99-survivalfox-keepalive.conf
  ClientAliveInterval 60, ClientAliveCountMax 3, TCPKeepAlive yes
- If SSH drops: check `journalctl -u ssh -n 200`
- Avoid stray paste lines (e.g. single commas) that produce ": command not found"
