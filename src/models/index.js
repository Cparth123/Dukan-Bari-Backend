const UserModel = require('./User');
const StoreModel = require('./Store');
const ProductModel = require('./Product');
const ConversationModel = require('./Conversation');
const MessageModel = require('./Message');
const EnquiryModel = require('./Enquiry');
const OfferModel = require('./Offer');
const ReviewModel = require('./Review');

module.exports = {
  User: UserModel,
  Store: StoreModel,
  Product: ProductModel,
  Conversation: ConversationModel,
  Message: MessageModel,
  Enquiry: EnquiryModel,
  Offer: OfferModel,
  Review: ReviewModel
};

