import { LightningElement, api, wire } from 'lwc';
import { updateRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCartItems from '@salesforce/apex/flowHelpers.getCartItems'; 
import { roundNum } from 'c/helper';

export default class OmsFlowPriceUpdate extends LightningElement {
    cartId; 
    cartItems = []; 
    errorMsg; 
    wiredCartResult;

    @api
    get shopCartId(){
        return this.cartId || '';
    }

    set shopCartId(data){
        this.cartId = data; 
        console.log('CartId set:', this.cartId);
    }

    // wire adapter to fetch cart items
    @wire(getCartItems, {cId: '$cartId'})
    wiredCart(result) {
        this.wiredCartResult = result;
        const {data, error} = result;
        if(data){
            console.log('Raw cart data received:', JSON.stringify(data, null, 2));
            this.cartItems = data.map(item => {
                const mappedItem = {
                    ...item,
                    margin: this.calculateMargin(item.SalesPrice, item.Product2.Product_Cost__c),
                    readonly: item.Product2.Agency_Pricing__c
                };
                console.log(`Mapped item: ${JSON.stringify(mappedItem, null, 2)}`);
                return mappedItem;
            });
            console.log('Processed cart items:', JSON.stringify(this.cartItems, null, 2));
            this.errorMsg = undefined; 
        } else if(error){
            console.error('Error fetching cart items:', error);
            this.errorMsg = error; 
        }
    }

    // helper to calculate margin
    calculateMargin(revenue, cost) {
        console.log(`Calculating margin - Revenue: ${revenue}, Cost: ${cost}`);
        if (typeof revenue !== 'number' || typeof cost !== 'number' || revenue === 0) {
            console.warn('Invalid input or zero revenue, returning 0');
            return 0;
        }
        const margin = roundNum(((revenue - cost) / revenue) * 100, 2);
        console.log(`Calculated margin: ${margin}%`);
        return margin;
    }

    // method to update price based off user input that will update margin put a setTimeOut on 
    updatePrice(event) {
        const id = event.target.dataset.id;
        const value = event.target.value;
        console.log(`Price update triggered - ID: ${id}, New Value: ${value}`);
    
        // Clear any existing timeout
        if (this.updatePriceTimeout) {
            clearTimeout(this.updatePriceTimeout);
        }
    
        // Set a new timeout
        this.updatePriceTimeout = setTimeout(() => {
            console.log(`Updating price after timeout - ID: ${id}, New Value: ${value}`);
            const updatedItem = this.cartItems.find(item => item.Id === id);
            if (updatedItem) {
                updatedItem.SalesPrice = parseFloat(value);
                updatedItem.margin = this.calculateMargin(updatedItem.SalesPrice, updatedItem.Product2.Product_Cost__c);
                console.log(`Updated item after price change: ${JSON.stringify(updatedItem, null, 2)}`);
                this.cartItems = [...this.cartItems];
            } else {
                console.warn(`Item with ID ${id} not found`);
            }
        }, 500); // 500 milliseconds = 0.5 seconds
    }

    // method to update margin based off user input that will update the sales price put a setTimeOut on 
    updateMargin(event) {
        const id = event.target.dataset.id;
        const value = event.target.value;
        console.log(`Margin update triggered - ID: ${id}, New Value: ${value}`);
    
        // Clear any existing timeout
        if (this.updateMarginTimeout) {
            clearTimeout(this.updateMarginTimeout);
        }
    
        // Set a new timeout
        this.updateMarginTimeout = setTimeout(() => {
            console.log(`Updating margin after timeout - ID: ${id}, New Value: ${value}`);
            const updatedItem = this.cartItems.find(item => item.Id === id);
            if (updatedItem) {
                const newMargin = parseFloat(value) / 100; // Convert percentage to decimal
                const cost = updatedItem.Product2.Product_Cost__c;
                updatedItem.SalesPrice = roundNum(cost / (1 - newMargin), 2);
                updatedItem.margin = parseFloat(value);
                console.log(`Updated item after margin change: ${JSON.stringify(updatedItem, null, 2)}`);
                this.cartItems = [...this.cartItems];
            } else {
                console.warn(`Item with ID ${id} not found`);
            }
        }, 500); // 500 milliseconds = 0.5 seconds
    }

    // method to save changes using updateRecord, after successful update, it forces a window reload
    saveChanges() {
        console.log('Saving changes...');
        const updates = this.cartItems.map(item => ({
            fields: {
                Id: item.Id,
                SalesPrice: item.SalesPrice
            }
        }));
        console.log('Updates to be sent:', JSON.stringify(updates, null, 2));

        const updatePromises = updates.map(update => updateRecord(update));

        Promise.all(updatePromises)
            .then(() => {
                console.log('All updates successful');
                this.showSuccessToast('Changes saved successfully');
                // Update local state to reflect saved changes
                this.cartItems = this.cartItems.map(item => {
                    console.log(`Updated item in local state: ${JSON.stringify(item, null, 2)}`);
                    return {...item};
                });
            })
            .catch(error => {
                console.error('Error updating records:', error);
                this.errorMsg = error.body ? error.body.message : error.message;
                this.showErrorToast('Error saving changes');
            });
    }

    refreshCartItems() {
        console.log('Refreshing cart items');
        return refreshApex(this.wiredCartResult)
            .then(() => {
                console.log('Cart items refreshed successfully');
            })
            .catch(error => {
                console.error('Error refreshing cart items:', error);
                this.showErrorToast('Error refreshing cart items');
            });
    }

    showSuccessToast(message) {
        console.log(`Showing success toast: ${message}`);
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success',
            message: message,
            variant: 'success',
        }));
    }

    showErrorToast(message) {
        console.log(`Showing error toast: ${message}`);
        this.dispatchEvent(new ShowToastEvent({
            title: 'Error',
            message: message,
            variant: 'error',
        }));
    }
}
