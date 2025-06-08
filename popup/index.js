import {GoogleGenAI, Type} from '@google/genai';

document.getElementById('organize-tabs').addEventListener('click', async () => {
  try {
    if (!chrome || !chrome.tabs) {
      throw new Error('chrome.tabs API not available');
    }
    chrome.tabs.query({}, async (tabs) => {
      try {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        const tabInfos = tabs.map(tab => ({
          active: tab.active,
          title: tab.title,
          url: tab.url
        }));
        console.log('All tabs info:', tabInfos);

        const ai = new GoogleGenAI({apiKey: "AIzaSyBKVOZAYHfxKpokmxu1oYtbVgTBBVnnrTs"});

        async function main() {
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Given the following browser tabs, organize them into groups based on their task, using the tab titles and URLs. Make sure it is organized by the inferred task to have fewer groups. Be general, and name them based on the task they are for rather than the tab names. Make sure that New Tabs or other blank tabs get sorted into their own group. Each group should have a groupName and a list of tabs. Each tab should include its title, url, and whether it is the active tab. The active tab must remain in its group and marked as active. All tabs in each group should be sorted alphabetically by title. Return the result as a JSON array of groups, where each group has a groupName and a tabs array. If there are no tabs, return an empty array. 

    Tabs:
    ${JSON.stringify(tabInfos, null, 2)}
    `,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    groupName: { type: Type.STRING },
                    tabs: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          url: { type: Type.STRING },
                          active: { type: Type.BOOLEAN }
                        },
                        propertyOrdering: ["title", "url", "active"]
                      }
                    }
                  },
                  propertyOrdering: ["groupName", "tabs"]
                }
              }
            }
          });
          return response;
        }

        const response = await main();

        console.log(response.text);

        if (response && response.text) {
          let groups;
          try {
            groups = JSON.parse(response.text);
          } catch (e) {
            console.error('Failed to parse AI response:', e);
            return;
          }

          for (const group of groups) {
            // Create a new tab group for each group
            const tabIds = [];
            for (const tab of group.tabs) {
              // Find the tab by URL (or title as fallback)
              const matchingTabs = await new Promise((resolve) => {
                chrome.tabs.query({ url: tab.url }, resolve);
              });
              if (matchingTabs && matchingTabs.length > 0) {
                tabIds.push(matchingTabs[0].id);
              }
            }
            if (tabIds.length > 0) {
              chrome.tabs.group({ tabIds }, (groupId) => {
                if (chrome.runtime.lastError) {
                  console.error('Error grouping tabs:', chrome.runtime.lastError);
                  return;
                }
                chrome.tabGroups.update(groupId, { title: group.groupName }, () => {
                  chrome.action.setBadgeText({ text: `${groups.length}` });
                  chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
                });
              });
            }
          }
        }
      } catch (error) {
        console.error('Error during AI content generation:', error);
      }
    });
  } catch (error) {
    console.error('Failed to get tabs info:', error);
  }
});

let focusMode = false;
const focusBtn = document.getElementById('focus');
focusBtn.textContent = 'Focus active group';

function updateFocusButtonState() {
  chrome.tabGroups.query({}, (groups) => {
    if (!groups || groups.length === 0) {
      focusBtn.disabled = true;
      focusBtn.style.opacity = '0.5';
      focusBtn.title = 'No tab groups to focus';
    } else {
      focusBtn.disabled = false;
      focusBtn.style.opacity = '1';
      focusBtn.title = '';
    }
  });
}

updateFocusButtonState();
const intervalId = setInterval(updateFocusButtonState, 1000);

focusBtn.addEventListener('click', () => {
  if (focusBtn.disabled) return;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabGroups.query({ windowId: tab.windowId }, (groups) => {
      groups.forEach(group => {
        chrome.tabGroups.update(group.id, {
          collapsed: !focusMode && group.id !== tab.groupId
        });
      });
      focusMode = !focusMode;
      focusBtn.textContent = focusMode
        ? 'Open all groups'
        : 'Focus active group';
    });
  });
});

document.getElementById('remove-all-tab-groups').addEventListener('click', () => {
  chrome.tabGroups.query({}, (groups) => {
    groups.forEach(group => {
      // find all tabs in this group
      chrome.tabs.query({ groupId: group.id }, (tabs) => {
        const tabIds = tabs.map(t => t.id).filter(id => id != null)
        if (tabIds.length) {
          // remove these tabs from their groups
          chrome.tabs.ungroup(tabIds, () => {
            if (chrome.runtime.lastError) {
              console.error('Error ungrouping tabs:', chrome.runtime.lastError)
            }
          })
        }
      })
    })
  })
})
