chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('page.html')
  });
});


chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'run-script') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: searchAndClickCheckboxes,
        args: [message.userInputList],
      }).then(results => {
        const count = results[0].result;
        chrome.runtime.sendMessage({ type: 'update-result', count });
      });
    });
  }
});

function searchAndClickCheckboxes(userInputList) {
  let count = 0;
  const labels = document.querySelectorAll('label');

  labels.forEach(label => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    const text = label.textContent.trim().toLowerCase();
    if (userInputList.some(input => text.includes(input.toLowerCase())) && !checkbox.checked) {
      checkbox.click();
      count++;
    }
  });
  
  return count;
}

/*
<form action="/action_page.php" data-gtm-form-interact-id="0">
  <label>
    <input type="checkbox" name="vehicle1" value="Bike">
    I have a bike
  </label>
  <label>
    <input type="checkbox" name="vehicle2" value="Unicycle">
    I have a unicycle
  </label>
  <label>
    <input type="checkbox" name="vehicle2" value="Car">
    I have a car
  </label>
  <label>
    <input type="checkbox" name="vehicle3" value="Boat">
    I have a boat
  </label>
  <label>
    <input type="checkbox" name="vehicle3" value="Motorcycle">
    I have a motorcycle
  </label>
  <label>
    <input type="checkbox" name="vehicle1" value="Bike">
    I have a bike
  </label>
  <label>
    <input type="checkbox" name="vehicle2" value="Car">
    I have a car
  </label>
  <label>
    <input type="checkbox" name="vehicle3" value="Tricycle">
    I have a tricycle
  </label>
  <label>
    <input type="checkbox" name="vehicle3" value="Boat">
    I have a boat
  </label>
  <input type="submit" value="Submit">
</form>
*/