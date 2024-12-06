import pygame

pygame.init()

#game Window
screen_width=800
screen_height=600

screen=pygame.display.set_mode((screen_width,screen_height))
player=pygame.Rect((300,250,50,50))
player2=pygame.Rect((200,250,50,50))
#game loop
run=True
while(run==True):
    screen.fill((0,0,0))
                            #R   G B
    pygame.draw.rect(screen,(250,250,0),player)
    pygame.draw.rect(screen,(250,250,0),player2)

    key=pygame.key.get_pressed()
    
    if key[pygame.K_a]==True:
        player.move_ip(-1,0)
    if key[pygame.K_d]==True:
        player.move_ip(+1,0)    
    if key[pygame.K_w]==True:
        player.move_ip(0,-1)
    if key[pygame.K_s]==True:
        player.move_ip(0,1)     
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