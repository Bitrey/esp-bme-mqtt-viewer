# Amella IoT

Interfaccia web per visualizzare i dati forniti dal microcontrollore ESP32 a cui vi è attaccato un sensore di temperatura, umidità e pressione BME280.

I dati, salvati su un database MongoDB, possono essere visualizzati su grafico, filtrati ed esportati in CSV o Excel. 

All'interno della cartella `esp32-iot-amella` si trovano i file del progetto PlatformIO, mentre i file del server Node si trovano all'interno di `esp-viewer`

Per utilizzare il server Node bisogna
- Avere Node.js installato
- Eseguire `npm install` per installare le dependencies
- Eseguire `npm run dev` per eseguire il programma in DEVELOPMENT, oppure `npm start` per transpilare il codice TypeScript in JavaScript ed eseguirlo in PRODUCTION
