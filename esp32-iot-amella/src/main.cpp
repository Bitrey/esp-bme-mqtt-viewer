#include <Adafruit_BME280.h>
#include <Adafruit_I2CDevice.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Sensor.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <BME280I2C.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <Wire.h>
#include <string.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C

// Functions signature
void initDisplay();
void initBME();
void initWiFi();
void initMQTT();
void readData();
void sendData();

// BME object
BME280I2C bme;

// Display object
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Config
const int delayBetweenSendMs = 5000;

// WiFi credentials
// const char *ssid = "5f yaro";
// const char *password = "pavlik69";
const char *ssid = "Fast Catto 3.0";
const char *password = "fioccofibra";

// MQTT Broker info
const char *mqtt_broker = "mqtt.ssh.edu.it";
const char *topic = "amella/esp32";
const char *mqtt_username = "amellaesp32";
const char *mqtt_password = "provaprova";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

float temp(NAN), hum(NAN), pres(NAN);  // global variables to store BME data
bool ready = false;                    // flag if ready to publish
int dataLastSent = -1;                 // take time into account before sending data

void setup() {
    // Init Serial communication
    Serial.begin(9600);

    //  Init Wire library
    Wire.begin();

    // Init SSD1306 display
    initDisplay();

    // Init BME280
    initBME();

    // Init WiFi
    initWiFi();

    // Connect to MQTT broker
    initMQTT();

    // Ready to send data
    ready = true;
}

int lastScreenUpdate = -1;
bool headerFlag = false;
int headerTime = 0;

void loop() {
    // MQTT loop
    client.loop();

    // Current time
    int now = millis();

    // Publish data every n seconds and only if ready
    if (now - dataLastSent > delayBetweenSendMs && ready) {
        // Specified seconds have passed, read and send BME data
        readData();
        sendData();

        // Update dataLastSent data
        dataLastSent = now;

        // Print to console and display
        Serial.printf("Published new data at t=%ims\n", now);
    }

    if (now - lastScreenUpdate > 100) {
        headerTime++;

        display.clearDisplay();
        display.setTextSize(2);
        display.setCursor(0, 0);
        if (headerTime > 30) {
            headerFlag = !headerFlag;
            headerTime = 0;
        }

        if (headerFlag) {
            display.printf("Up: %.0fs\n", now / 1000.0f);
        } else {
            display.println("Publishing");
        }

        display.print("T=");
        display.print(temp);
        display.println("^C");
        display.printf("P=%.0fhPa\n", pres / 100.0f);
        display.print("H=");
        display.print(hum);
        display.println("%");
        display.display();

        lastScreenUpdate = now;
    }
}

void initDisplay() {
    if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        Serial.println(F("SSD1306 allocation failed"));  // se il display non funziona
        for (;;) {
        };  // Don't proceed, loop forever
    }

    display.display();

    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(WHITE);
    display.setTextWrap(false);
    display.setCursor(0, 0);

    display.println("Starting");
    display.print("Init OLED");
    display.display();
}

void initBME() {
    display.clearDisplay();
    display.setCursor(0, 0);

    display.println("Starting");
    display.print("Init BME");
    display.display();

    while (!bme.begin()) {
        Serial.println("Can't find a valid BME280 sensor!");
        delay(1000);
    }
}

void initWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    Serial.print("Connecting to WiFi network...");

    int now = millis();

    while (WiFi.status() != WL_CONNECTED) {
        Serial.print('.');

        display.clearDisplay();
        display.setTextSize(2);
        display.setCursor(0, 0);

        int diff = (millis() - now);

        display.println("WiFi");
        display.println("Connecting");
        display.setTextWrap(false);
        display.println(ssid);
        display.printf("%.0fs\n", diff / 1000.0f);
        // display.printf(" % 7 l,.0fs\n", diff / 1000.0f);

        display.display();
        delay(1000);
    };

    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("\nIP: ");
    Serial.println(WiFi.localIP());

    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Connected");
    display.print(ssid);
    display.display();
}

void initMQTT() {
    client.setServer(mqtt_broker, mqtt_port);
    while (!client.connected()) {
        // Client ID is amella-esp32-MAC_ADDRESS
        String client_id = "amella-esp32-";
        client_id += String(WiFi.macAddress());

        Serial.printf("Connecting to MQTT broker with client ID %s...\n", client_id.c_str());

        display.clearDisplay();
        display.setTextSize(2);
        display.setCursor(0, 0);

        display.println("MQTT");
        display.println("Connecting");
        display.setTextSize(1);
        display.println(mqtt_broker);
        display.setTextSize(2);
        display.display();

        if (client.connect(client_id.c_str(), mqtt_username, mqtt_password)) {
            Serial.println("Connected to MQTT broker!");

            display.clearDisplay();
            display.setTextSize(2);
            display.setCursor(0, 0);

            display.println("MQTT");
            display.println("Connected");
            display.setTextSize(1);
            display.println(mqtt_broker);
            display.setTextSize(2);
            display.display();

        } else {
            Serial.print("Connection failed with status code ");
            Serial.print(client.state());

            display.clearDisplay();
            display.setCursor(0, 0);

            display.println("MQTT");
            display.print("Failed: ");
            display.println(client.state());
            display.println(mqtt_broker);
            display.display();

            delay(2000);
        }
    }
}

void readData() {
    Serial.println("Reading BME data...");
    BME280::TempUnit tempUnit(BME280::TempUnit_Celsius);  // celsius
    BME280::PresUnit presUnit(BME280::PresUnit_Pa);       // pascal
    bme.read(pres, temp, hum, tempUnit, presUnit);        // read data
}

void sendData() {
    Serial.println("Sending BME data...");

    // Create JSON object
    DynamicJsonDocument doc(1024);

    // Buffer to store output
    char output[64];

    // Save data into object
    doc["temp"] = temp;
    doc["pres"] = pres;
    doc["hum"] = hum;

    // Serialize JSON object into string
    serializeJson(doc, output);

    // Publish to MQTT
    client.publish("amella/esp32/data", output);
}
