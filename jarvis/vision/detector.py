import cv2
import mediapipe as mp

class JarvisVision:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_draw = mp.solutions.drawing_utils
        self.cap = None

    def start_camera(self):
        self.cap = cv2.VideoCapture(0)
        print("[SISTEMA] Câmera ativada. Escaneando ambiente...")

    def detect_gestures(self):
        if not self.cap:
            return
            
        success, img = self.cap.read()
        if not success:
            return
            
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self.hands.process(img_rgb)
        
        if results.multi_hand_landmarks:
            for hand_lms in results.multi_hand_landmarks:
                # Aqui detectamos os dedos levantados para os comandos 'Tony Stark'
                # Exemplo simplificado: contar dedos
                self.mp_draw.draw_landmarks(img, hand_lms, self.mp_hands.HAND_CONNECTIONS)
                
        # cv2.imshow("Jarvis Vision", img) # Descomentar para visualizar
        return results

    def stop_camera(self):
        if self.cap:
            self.cap.release()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    v = JarvisVision()
    v.start_camera()
    try:
        while True:
            v.detect_gestures()
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        v.stop_camera()
