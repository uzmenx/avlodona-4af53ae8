const fs = require('fs');
const path = require('path');

function useDirectChatItem() {
  const filePath = path.join('src', 'pages', 'Messages.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Add import
  if (!content.includes('DirectChatItem')) {
    content = content.replace(
      "import { GroupChatItem } from '@/components/groups/GroupChatItem';",
      "import { GroupChatItem } from '@/components/groups/GroupChatItem';\nimport { DirectChatItem } from '@/components/chat/DirectChatItem';"
    );
  }

  // 2. Replace itemContent logic inside 'all'
  // I will replace the whole block starting from `itemContent={(_, item) => {` down to its `return <GroupChatItem...`
  // Actually, let's just replace the exact block. Since regex might be tricky, let's use a simpler replacement based on strings.
  
  const searchString = `itemContent={(_, item) => {
                          if (item.chatType === 'direct') {
                            return (
                              <div
                                onClick={() => {
                                  if (isEditMode) {
                                    setSelectedConvIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                      return next;
                                    });
                                  } else {
                                    handleUserClick(item.otherUser.id);
                                  }
                                }}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 relative overflow-hidden',
                                  isEditMode ? 'translate-x-0' : '',
                                  isEditMode && selectedConvIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-white/5 active:bg-white/10'
                                )}
                              >
                                {/* Telegram-style selection circle */}
                                {isEditMode && (
                                  <div className="flex-shrink-0 flex items-center justify-center w-6 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
                                    <div className={cn(
                                      "h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
                                      selectedConvIds.has(item.id) 
                                        ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20" 
                                        : "border-muted-foreground/30 bg-transparent"
                                    )}>
                                      {selectedConvIds.has(item.id) && <Icon icon="lucide:check" className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                  </div>
                                )}

                                <div className="relative">
                                  {(() => {
                                    const storyInfo = getStoryInfo(item.otherUser.id);
                                    if (storyInfo) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openStoriesForUser(item.otherUser.id);
                                          }}
                                          className="h-12 w-12 rounded-full p-[2px] flex items-center justify-center"
                                          style={{
                                            background: storyInfo.has_unviewed ? getStoryRingGradient(storyInfo.ring_id) : undefined
                                          }}
                                        >
                                          {!storyInfo.has_unviewed && <div className="absolute inset-0 rounded-full bg-muted-foreground/30 p-[2px]" />}
                                          <div className="w-full h-full rounded-full bg-background p-[1.5px]">
                                            <Avatar className="h-full w-full">
                                              <AvatarImage src={item.otherUser.avatar_url || undefined} loading="lazy" decoding="async" />
                                              <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
                                            </Avatar>
                                          </div>
                                        </button>
                                      );
                                    }
                                    return (
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={item.otherUser.avatar_url || undefined} loading="lazy" decoding="async" />
                                        <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
                                      </Avatar>
                                    );
                                  })()}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <StarUsername username={item.otherUser.username || item.otherUser.name || 'Foydalanuvchi'} />
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {item.last_message_at ? formatTime(item.last_message_at) : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className={cn(
                                      "text-sm truncate leading-snug",
                                      item.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}>
                                      {item.lastMessage?.sender_id === user?.id ? \`\${t('you')}: \` : ""}
                                      {item.lastMessage?.content || t('noMessagesYet')}
                                    </p>
                                    {item.unreadCount > 0 && (
                                      <div className="bg-primary text-primary-foreground min-w-[20px] h-5 rounded-full px-1.5 flex items-center justify-center text-[10px] font-bold shadow-sm shadow-primary/20 shrink-0">
                                        {item.unreadCount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (`;

  const newString = `itemContent={(_, item) => {
                          if (item.chatType === 'direct') {
                            return (
                              <DirectChatItem
                                item={item}
                                isEditMode={isEditMode}
                                isSelected={selectedConvIds.has(item.id)}
                                currentUserId={user?.id}
                                storyInfo={getStoryInfo(item.otherUser.id)}
                                onClick={() => handleUserClick(item.otherUser.id)}
                                onToggleSelect={() => {
                                  setSelectedConvIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                    return next;
                                  });
                                }}
                                onStoryClick={(userId) => openStoriesForUser(userId)}
                              />
                            );
                          }
                          return (`;

  content = content.replace(searchString, newString);

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Applied DirectChatItem.');
}

useDirectChatItem();
