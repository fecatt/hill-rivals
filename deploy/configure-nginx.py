from pathlib import Path
import shutil
import subprocess
import time

config = Path('/etc/nginx/nginx.conf')
backup = str(config) + '.hill-rivals-backup-' + str(int(time.time()))
shutil.copy2(config, backup)
text = config.read_text()
if 'mirea-racing.sayaka.ru' not in text:
    text = text.replace('map $ssl_preread_server_name $sni_backend {',
                        'map $ssl_preread_server_name $sni_backend {\n        mirea-racing.sayaka.ru 127.0.0.1:9458;')
    config.write_text(text)
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    shutil.copy2(backup, config)
    raise

# Renew through the public HTTP ACME path, without the incompatible nginx installer.
renewal = Path('/etc/letsencrypt/renewal/mirea-racing.sayaka.ru.conf')
shutil.copy2(renewal, str(renewal) + '.hill-rivals-backup')
text = renewal.read_text().replace('authenticator = nginx', 'authenticator = webroot')
text = '\n'.join(line for line in text.splitlines() if not line.startswith('installer ='))
if 'webroot_path =' not in text:
    text += '\nwebroot_path = /var/www/certbot,\nrenew_hook = systemctl reload nginx\n[[webroot_map]]\nmirea-racing.sayaka.ru = /var/www/certbot\n'
renewal.write_text(text)
