/*
  Running Mate Receiver
  Receives commands from Web Serial API.
  Protocol:
    - "S:<value>" -> Set Speed (e.g., "S:10")
    - "STOP"      -> Stop Motor
*/

String inputString = "";         // a String to hold incoming data
bool stringComplete = false;  // whether the string is complete

// Define your motor control pins here
// const int MOTOR_PIN = 9; 

void setup() {
  // Initialize serial:
  Serial.begin(9600);
  // reserve 200 bytes for the inputString:
  inputString.reserve(200);
  
  // pinMode(MOTOR_PIN, OUTPUT);
}

void loop() {
  // print the string when a newline arrives:
  if (stringComplete) {
    processCommand(inputString);
    // clear the string:
    inputString = "";
    stringComplete = false;
  }
}

void processCommand(String command) {
  command.trim(); // Remove whitespace
  
  if (command.startsWith("S:")) {
    // Speed Command
    String speedStr = command.substring(2);
    int speedVal = speedStr.toInt();
    
    Serial.print("Received Speed: ");
    Serial.println(speedVal);
    
    // TODO: Map speedVal (0-10) to PWM (0-255) or other control logic
    // int pwmVal = map(speedVal, 0, 10, 0, 255);
    // analogWrite(MOTOR_PIN, pwmVal);
    
  } else if (command.equals("STOP")) {
    Serial.println("Stopping...");
    // analogWrite(MOTOR_PIN, 0);
  }
}

/*
  SerialEvent occurs whenever a new data comes in the hardware serial RX. This
  routine is run between each time loop() runs, so using delay inside loop can
  delay response. Multiple bytes of data may be available.
*/
void serialEvent() {
  while (Serial.available()) {
    // get the new byte:
    char inChar = (char)Serial.read();
    // add it to the inputString:
    inputString += inChar;
    // if the incoming character is a newline, set a flag so the main loop can
    // do something about it:
    if (inChar == '\n') {
      stringComplete = true;
    }
  }
}
