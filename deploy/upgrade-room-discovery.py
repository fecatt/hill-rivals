from pathlib import Path
import shutil
import subprocess

config = Path('/etc/nginx/sites-enabled/hill-rivals').resolve(strict=True)
if config.name != 'hill-rivals' or not str(config).startswith('/etc/nginx/'):
    raise RuntimeError('Unexpected game nginx configuration path')
text = config.read_text()
old = 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;'
new = 'proxy_set_header X-Forwarded-For $proxy_protocol_addr;'
if old in text:
    backup = config.with_name(config.name + '.before-room-discovery')
    if not backup.exists():
        shutil.copy2(config, backup)
    config.write_text(text.replace(old, new))
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        config.write_text(text)
        raise
elif new not in text:
    raise RuntimeError('Expected game proxy header was not found')
print('Game proxy forwards the original client IP for room discovery')
