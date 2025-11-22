#include <EVShield.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); // 필요하면 0x3F로 변경
EVShield evshield;

const int ledPin = 7; // LED IN (신호핀)
bool running = false; // 현재 LED가 켜져 있는 상태인지
bool lastGo = false;  // 직전 GO 버튼 상태 (엣지 감지용)

String inputString = "";     // 수신된 데이터 저장
bool stringComplete = false; // 데이터 수신 완료 여부

void showReady() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Hello!");
  lcd.setCursor(0, 1);
  lcd.print("Ready to run?");
}

void showRunning(int speed) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LED ON");
  lcd.setCursor(0, 1);
  lcd.print("Speed: " + String(speed));
}

void showStopped() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("LED OFF");
  lcd.setCursor(0, 1);
  lcd.print("Ready to run?");
}

void setup() {
  Serial.begin(9600); // 블루투스 통신을 위한 시리얼 초기화

  lcd.init();
  lcd.backlight();

  evshield.init(SH_HardwareI2C); // EVShield 초기화

  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW); // 시작은 꺼진 상태

  showReady();
}

void showConnected() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Bluetooth");
  lcd.setCursor(0, 1);
  lcd.print("Connected!");
}

void processCommand(String command) {
  command.trim();

  if (command.startsWith("S:")) {
    // Speed Command (e.g., "S:5")
    String speedStr = command.substring(2);
    int speed = speedStr.toInt();

    running = true;
    digitalWrite(ledPin, HIGH);
    showRunning(speed);

  } else if (command.equals("STOP")) {
    running = false;
    digitalWrite(ledPin, LOW);
    showStopped();
  } else if (command.equals("CONN")) {
    showConnected();
  }
}

void loop() {
  // 1. 블루투스/시리얼 명령 처리
  if (stringComplete) {
    processCommand(inputString);
    inputString = "";
    stringComplete = false;
  }

  // 2. EVShield의 GO 버튼 상태 읽기 (수동 제어)
  bool goPressed = evshield.getButtonState(BTN_GO);

  // 버튼이 "지금 막 눌렸을 때"만 반응 (토글)
  if (goPressed && !lastGo) {
    running = !running; // 상태 뒤집기

    if (running) {
      // LED 켜기 (수동 시작 시 속도는 기본값 또는 이전값 표시가 애매하므로 그냥
      // Running 표시)
      digitalWrite(ledPin, HIGH);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("LED ON");
      lcd.setCursor(0, 1);
      lcd.print("Manual Run");
    } else {
      // LED 끄기
      digitalWrite(ledPin, LOW);
      showStopped();
    }

    delay(80); // 디바운스
  }

  lastGo = goPressed;

  delay(20);
}

/*
  SerialEvent는 하드웨어 시리얼 RX에 새로운 데이터가 들어올 때마다 호출됩니다.
*/
void serialEvent() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    inputString += inChar;
    if (inChar == '\n') {
      stringComplete = true;
    }
  }
}
