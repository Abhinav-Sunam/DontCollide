import pygame

pygame.init()

#game Window
screen_width=1512
screen_height=982
pygame.display.set_caption("DontCollide!")

screen=pygame.display.set_mode((screen_width,screen_height))
player1=pygame.Rect((300,250,50,50))
player2=pygame.Rect((1200,250,50,50))
dont_touch_obj=pygame.Rect((200,250,30,30))

logo = pygame.image.load("logo.png")  
logo = pygame.transform.smoothscale(logo, (300*2.5, 75*2.5))

logo_rect = logo.get_rect(center=(screen_width // 2, 80))

#game loop
run=True
while(run==True):
    screen.fill((0,0,0))
                            #R   G B
    pygame.draw.rect(screen,(250,250,0),player1)
    pygame.draw.rect(screen,(0,250,250),player2)

    pygame.draw.rect(screen,(0,250,250),dont_touch_obj)

    screen.blit(logo, logo_rect)
    

    key=pygame.key.get_pressed()
    
    if key[pygame.K_a]==True:
        player1.move_ip(-1,0)
    if key[pygame.K_d]==True:
        player1.move_ip(+1,0)    
    if key[pygame.K_w]==True:
        player1.move_ip(0,-1)
    if key[pygame.K_s]==True:
        player1.move_ip(0,1)     
    if key[pygame.K_UP]==True:
        player2.move_ip(0,-1)     
    if key[pygame.K_DOWN]==True:
        player2.move_ip(0,1)     
    if key[pygame.K_RIGHT]==True:
        player2.move_ip(1,0)       
    if key[pygame.K_LEFT]==True:
        player2.move_ip(-1,0)      
               

#event handler
    for event in pygame.event.get():
        if event.type==pygame.QUIT:
            run=False

    pygame.display.update()        
#event handl;er ends            
pygame.quit()            