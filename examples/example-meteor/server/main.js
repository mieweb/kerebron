import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

Meteor.startup(async () => {});

const channelSubscribers = new Map();

const collectionName = 'ephemeralChannel';

Meteor.publish(collectionName, function (channelId) {
  // You can restrict which clients can subscribe to which channels inside the publish() function:
  // if (!this.userId && channelId.startsWith('private-')) {
  //   return this.stop();
  // }

  if (!channelSubscribers.has(channelId)) {
    channelSubscribers.set(channelId, new Set());
  }

  const subs = channelSubscribers.get(channelId);
  subs.add(this);

  this.onStop(() => {
    subs.delete(this);
    if (subs.size === 0) {
      channelSubscribers.delete(channelId);
    }
  });

  this.ready();
});


Meteor.methods({
  [collectionName + 'SendMessage'](channelId, text) {
    const senderSub = this;
    const messageId = Random.id();
    const message = {
      _id: messageId,
      text,
      channelId,
      userId: this.userId,
      createdAt: new Date(),
    };

    const subs = channelSubscribers.get(channelId);
    if (!subs) return;

    subs.forEach(sub => {
      if (sub !== senderSub) { // <-- skip the sender
        sub.added(collectionName + 'Messages', messageId, message);
        sub.changed(collectionName + 'Messages', messageId, message);
      }
    });
  }
});
