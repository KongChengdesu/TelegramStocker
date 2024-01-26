# resetservice.sh
#!/bin/bash
pm2 stop TelegramStocker
pm2 delete TelegramStocker
pm2 save
rm -rf ~/apps/TelegramStocker
mkdir ~/apps/TelegramStocker
cp -r ~/stocker-runner/_work/TelegramStocker/TelegramStocker/* ~/apps/TelegramStocker
cp ~/stocker.env ~/apps/TelegramStocker/.env
cd ~/apps/TelegramStocker
pm2 start ecosystem.config.js
pm2 save