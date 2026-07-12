const fs = require('fs');
const path = require('path');

function replaceWithVirtuoso() {
  const filePath = path.join('src', 'pages', 'Messages.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');

  // Groups
  const groupsRegex = /filteredGroups\.map\(\(group\) =>[\s\S]*?<\/[a-zA-Z]*>\s*\)/g;
  const groupsReplacement = `<Virtuoso
              useWindowScroll
              data={filteredGroups}
              computeItemKey={(_, group) => group.id}
              itemContent={(_, group) => (
                <GroupChatItem 
                  key={group.id} 
                  chat={group as any} 
                  isEditMode={isEditMode}
                  isSelected={isEditMode && selectedConvIds.has(group.id)}
                  onClick={() => {
                    if (isEditMode) {
                      setSelectedConvIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id); else
                        next.add(group.id);
                        return next;
                      });
                    } else {
                      handleGroupClick(group.id);
                    }
                  }} 
                />
              )}
            />`;

  // Channels
  const channelsRegex = /filteredChannels\.map\(\(channel\) =>[\s\S]*?<\/[a-zA-Z]*>\s*\)/g;
  const channelsReplacement = `<Virtuoso
              useWindowScroll
              data={filteredChannels}
              computeItemKey={(_, channel) => channel.id}
              itemContent={(_, channel) => (
                <GroupChatItem 
                  key={channel.id} 
                  chat={channel as any} 
                  isEditMode={isEditMode}
                  isSelected={isEditMode && selectedConvIds.has(channel.id)}
                  onClick={() => {
                    if (isEditMode) {
                      setSelectedConvIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(channel.id)) next.delete(channel.id); else
                        next.add(channel.id);
                        return next;
                      });
                    } else {
                      handleGroupClick(channel.id);
                    }
                  }} 
                />
              )}
            />`;

  // Followers
  const followersRegex = /filteredFollowers\.map\(\(follower\) =>[\s\S]*?Button>\s*<\/div>\s*\)/g;
  const followersReplacement = `<Virtuoso
              useWindowScroll
              data={filteredFollowers}
              computeItemKey={(_, follower) => follower.id}
              itemContent={(_, follower) => (
                <div
                  key={follower.id}
                  onClick={() => handleUserClick(follower.id)}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={follower.avatar_url || undefined} loading="lazy" decoding="async" />
                    <AvatarFallback>{getInitials(follower.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{follower.name || t('user')}</h3>
                    <div className="truncate">
                      <StarUsername username={follower.username || 'username'} textClassName="text-sm" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUserClick(follower.id); }}>
                    {t('messageBtn')}
                  </Button>
                </div>
              )}
            />`;

  // Following
  const followingRegex = /filteredFollowing\.map\(\(followingUser\) =>[\s\S]*?Button>\s*<\/div>\s*\)/g;
  const followingReplacement = `<Virtuoso
              useWindowScroll
              data={filteredFollowing}
              computeItemKey={(_, followingUser) => followingUser.id}
              itemContent={(_, followingUser) => (
                <div
                  key={followingUser.id}
                  onClick={() => handleUserClick(followingUser.id)}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={followingUser.avatar_url || undefined} loading="lazy" decoding="async" />
                    <AvatarFallback>{getInitials(followingUser.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{followingUser.name || t('user')}</h3>
                    <div className="truncate">
                      <StarUsername username={followingUser.username || 'username'} textClassName="text-sm" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUserClick(followingUser.id); }}>
                    {t('messageBtn')}
                  </Button>
                </div>
              )}
            />`;

  content = content.replace(groupsRegex, groupsReplacement);
  content = content.replace(channelsRegex, channelsReplacement);
  content = content.replace(followersRegex, followersReplacement);
  content = content.replace(followingRegex, followingReplacement);

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Virtuoso applied to all lists.');
}

replaceWithVirtuoso();
