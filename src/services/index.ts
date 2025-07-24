import api from './api';
import recipeService from './recipe';
import groceryService from './grocery';

export const services = {
  api,
  recipe: recipeService,
  grocery: groceryService
};

export default services;