#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#include <HardwareSerial.h>

#define MOTOR_PIN_1 18  // Motor control pins
#define MOTOR_PIN_2 19
#define LED_PIN 2       // Onboard blue LED (commonly GPIO 2)

BLECharacteristic *pCharacteristic;
bool isRampCard = false;

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    
    if (value == "RAMP") {
      isRampCard = true;
    } else if (value == "NONRAMP") {
      isRampCard = false;
    }
  }
};

void setup() {
  Serial.begin(115200);

  // Motor setup
  pinMode(MOTOR_PIN_1, OUTPUT);
  pinMode(MOTOR_PIN_2, OUTPUT);

  // LED setup
  pinMode(LED_PIN, OUTPUT);

  // BLE setup
  BLEDevice::init("ManaRampESP32");
  BLEServer *pServer = BLEDevice::createServer();
  
  BLEService *pService = pServer->createService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
  
  pCharacteristic = pService->createCharacteristic(
    "beb5483e-36e1-4688-b7f5-ea07361b26a8",
    BLECharacteristic::PROPERTY_WRITE
  );
  
  pCharacteristic->setCallbacks(new MyCallbacks());
  
  pService->start();
  
  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->start();
  
  Serial.println("Waiting for a BLE client to connect...");
}

void loop() {
  if (isRampCard) {
    // Spin wheels clockwise
    digitalWrite(MOTOR_PIN_1, HIGH);
    digitalWrite(MOTOR_PIN_2, LOW);
  } else {
    // Spin wheels anticlockwise
    digitalWrite(MOTOR_PIN_1, LOW);
    digitalWrite(MOTOR_PIN_2, HIGH);
  }
  
  // Blink onboard LED
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
