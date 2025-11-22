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

  // indexOf를 사용하여 부분 일치도 허용 (더 안정적)
  if (command.indexOf("S:") >= 0) {
    // Speed Command (e.g., "S:5")
    // "S:" 위치를 찾아서 그 뒤의 숫자를 파싱
    int index = command.indexOf("S:");
    String speedStr = command.substring(index + 2);
    int speed = speedStr.toInt();

    running = true;
    digitalWrite(ledPin, HIGH);
    showRunning(speed);

  } else if (command.indexOf("STOP") >= 0) {
    running = false;
    digitalWrite(ledPin, LOW);
    showStopped();
  } else if (command.indexOf("CONN") >= 0) {
    showConnected();
  }
}

void loop() {
  // 1. 블루투스/시리얼 명령 처리
  while (Serial.available()) {
    char inChar = (char)Serial.read();

    // 줄바꿈 문자(\n) 또는 캐리지 리턴(\r)이 오면 명령 종료로 인식
    if (inChar == '\n' || inChar == '\r') {
      if (inputString.length() > 0) {
        processCommand(inputString);
        inputString = "";
      }
    } else {
      inputString += inChar;
    }
  }

  // 2. EVShield의 GO 버튼 상태 읽기 (수동 제어)
  bool goPressed = evshield.getButtonState(BTN_GO);

  // 버튼이 "지금 막 눌렸을 때"만 반응 (토글)
  if (goPressed && !lastGo) {
    running = !running; // 상태 뒤집기

    if (running) {
      // LED 켜기
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
