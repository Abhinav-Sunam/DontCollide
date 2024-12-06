import pygame

pygame.init()

# Game Window
screen_width = 1512
screen_height = 982
pygame.display.set_caption("DontCollide!")

screen = pygame.display.set_mode((screen_width, screen_height))

# Load Player 1 Image and Create Rect for Movement
player1 = pygame.image.load("player1.png")
player1 = pygame.transform.smoothscale(player1, (50 * 1.5, 50 * 1.5))
player1_rect = player1.get_rect(topleft=(200, 250))  # Starting position for player 1

# Load Player 2 Rect
player2=pygame.image.load("player2.png")
player2 = pygame.transform.smoothscale(player2, (50 * 1.5, 50 * 1.5))
player2_rect = player2.get_rect(topleft=(400, 250))  # Starting position for player 2

# Load Other Objects
dont_touch_obj = pygame.image.load("gem.png")
dont_touch_obj = pygame.transform.smoothscale(dont_touch_obj, (50 * 0.5, 50 * 0.5))
map1 = pygame.image.load("map1.png")
map1 = pygame.transform.scale(map1, (screen_width, screen_height))
logo = pygame.image.load("logo.png")
logo = pygame.transform.smoothscale(logo, (300 * 2.5, 75 * 2.5))
logo_rect = logo.get_rect(center=(screen_width // 2, 80))

# Game Loop
run = True
speed = 5  # Movement speed for players
while run:
    # Draw the map and other elements
    screen.blit(map1, (0, 0))  # Draw background
    screen.blit(player1, player1_rect)  # Draw player 1 at its current position
    screen.blit(player2, player2_rect)  # Draw player 2 at its current position
    screen.blit(dont_touch_obj, (200, 250))  # Draw the gem
    screen.blit(logo, logo_rect)  # Draw the logo

    # Player Movement Logic
    key = pygame.key.get_pressed()
    if key[pygame.K_a]:  # Move player 1 left
        player1_rect.move_ip(-speed, 0)
    if key[pygame.K_d]:  # Move player 1 right
        player1_rect.move_ip(speed, 0)
    if key[pygame.K_w]:  # Move player 1 up
        player1_rect.move_ip(0, -speed)
    if key[pygame.K_s]:  # Move player 1 down
        player1_rect.move_ip(0, speed)
    if key[pygame.K_UP]:  # Move player 2 up
        player2_rect.move_ip(0, -speed)
    if key[pygame.K_DOWN]:  # Move player 2 down
        player2_rect.move_ip(0, speed)
    if key[pygame.K_RIGHT]:  # Move player 2 right
        player2_rect.move_ip(speed, 0)
    if key[pygame.K_LEFT]:  # Move player 2 left
        player2_rect.move_ip(-speed, 0)

    # Event Handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            run = False

    pygame.display.update()  # Refresh the screen

pygame.quit()